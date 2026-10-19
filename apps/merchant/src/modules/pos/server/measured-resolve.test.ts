import { describe, expect, it, vi } from "vitest";
import type { PosResolveV2 } from "../contracts";
import type { CounterCouponState } from "../../../server/counter/coupon-state";
const mocks = vi.hoisted(() => ({ context: vi.fn(), coupon: vi.fn() }));
vi.mock("../../../server/counter/resolve-context", () => ({
  resolveScanContext: mocks.context,
}));
vi.mock("../../../server/counter/coupon-state", () => ({
  counterCouponState: mocks.coupon,
}));
import { resolveMeasuredScan } from "./measured-resolve";

describe("minimal measured scan wire allow-list", () => {
  it("preserves exact money and strips server-only and future fields at every level", async () => {
    mocks.context.mockResolvedValue({
      consumerId: "private-account",
      displayName: "Marcos Pérez",
      qrToken: "private-token",
      locationId: "private-location",
      membership: {
        id: "membership",
        pointsBalance: 7,
        stampsCount: 2,
        justEnrolled: false,
        consumerId: "private-account",
      },
      program: {
        id: "program",
        kind: "points",
        accrualMode: "per_amount",
        accrualGrant: 3,
        accrualBlockAmount: "9007199254740993.01",
        configuration: { secret: "private-config" },
        stampImageObjectKey: "private-key",
        cardBackgroundColor: "private-color",
      },
    });
    const selected: CounterCouponState = {
      status: "selected",
      coupon: {
        couponId: "coupon",
        label: "Especial",
        kind: "custom",
        rule: "Solo los martes; consulta en caja.",
        productId: null,
        productName: null,
        discountUnit: null,
        discountValue: null,
        currencyCode: "USD",
        extraUnits: null,
        validUntil: new Date("2099-01-01T00:00:00.000Z"),
      },
      verdict: { valid: false, code: "coupon_expired", message: "Venció" },
    };
    mocks.coupon.mockResolvedValue({
      ...selected,
      coupon: { ...selected.coupon, consumerId: "private-account" },
    });
    const result: PosResolveV2 = await resolveMeasuredScan(
      { id: "business", currencyCode: "USD", status: "active" },
      "token",
      "location",
    );
    expect(mocks.context).toHaveBeenCalledWith(
      { id: "business", currencyCode: "USD", status: "active" },
      "token",
      "location",
    );
    expect(mocks.coupon).toHaveBeenCalledWith("business", "private-account");
    expect(result).toEqual({
      consumer: { displayName: "Marcos Pérez" },
      membership: {
        id: "membership",
        pointsBalance: 7,
        stampsCount: 2,
        justEnrolled: false,
      },
      program: {
        id: "program",
        kind: "points",
        accrual: {
          mode: "per_amount",
          grant: 3,
          blockAmount: "9007199254740993.01",
        },
      },
      couponState: {
        ...selected,
        coupon: { ...selected.coupon, validUntil: "2099-01-01T00:00:00.000Z" },
      },
    });
    for (const state of [
      { status: "none" },
      { status: "hint", count: 2 },
      { status: "used_today", label: "Especial" },
      { ...selected, verdict: { valid: true } },
    ]) {
      mocks.coupon.mockResolvedValue(state);
      const value = await resolveMeasuredScan(
        { id: "business", currencyCode: "USD", status: "active" },
        "token",
      );
      expect(value.couponState).toEqual(
        state.status === "selected"
          ? { ...result.couponState, verdict: { valid: true } }
          : state,
      );
    }
    mocks.context.mockRejectedValueOnce(new Error("invalid context"));
    const before = mocks.coupon.mock.calls.length;
    await expect(
      resolveMeasuredScan(
        { id: "business", currencyCode: "USD", status: "active" },
        "invalid",
      ),
    ).rejects.toThrow("invalid context");
    expect(mocks.coupon.mock.calls).toHaveLength(before);
  });
});
