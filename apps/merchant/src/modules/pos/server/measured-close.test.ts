import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseMeasuredCloseInput } from "./measured-close-input";
const key = randomUUID(),
  methodId = randomUUID(),
  membershipId = randomUUID();
const valid = () => ({
  clientRequestId: key,
  version: 1,
  payments: [{ methodId, amount: "1.005" }],
});
describe("internal V2 close syntax", () => {
  it("keeps original decimal authority and creates server payment identities", () => {
    const first = parseMeasuredCloseInput(valid());
    const second = parseMeasuredCloseInput(valid());
    expect(first.payments[0]).toMatchObject({ methodId, amount: "1.005" });
    expect(first.payments[0].paymentId).not.toBe(second.payments[0].paymentId);
    expect(
      parseMeasuredCloseInput({
        clientRequestId: key.toUpperCase(),
        version: 1,
      }),
    ).toMatchObject({ clientRequestId: key, payments: [], coupon: null });
  });
  it("accepts explicit coupon line and null/omitted product references", () => {
    const targetSourceLineId = randomUUID(),
      couponId = randomUUID();
    expect(
      parseMeasuredCloseInput({
        ...valid(),
        membershipId,
        coupon: { couponId, targetSourceLineId },
      }).coupon,
    ).toEqual({ couponId, targetSourceLineId });
    expect(
      parseMeasuredCloseInput({
        ...valid(),
        membershipId,
        coupon: { couponId, productId: null },
      }).coupon,
    ).toEqual({ couponId, productId: null });
  });
  it.each([
    null,
    [],
    {},
    { ...valid(), version: 0 },
    { ...valid(), version: 1.1 },
    { ...valid(), version: 2147483648 },
    { ...valid(), version: "1" },
    { ...valid(), clientRequestId: "bad" },
    { ...valid(), id: key },
    { ...valid(), membershipId: null },
    { ...valid(), membershipId: "" },
    { ...valid(), coupon: { couponId: randomUUID() } },
    {
      ...valid(),
      membershipId,
      coupon: { couponId: randomUUID(), quantity: "1" },
    },
    {
      ...valid(),
      membershipId,
      coupon: { couponId: randomUUID(), targetSourceLineId: "bad" },
    },
    { ...valid(), payments: [{ methodId, amount: "1", paymentId: key }] },
    { ...valid(), payments: [{ methodId: "bad", amount: "1" }] },
    { ...valid(), payments: [{ methodId, amount: 1 }] },
    { ...valid(), payments: null },
    {
      ...valid(),
      payments: Array.from({ length: 201 }, () => ({ methodId, amount: "1" })),
    },
  ])("rejects malformed or client-owned financial data %#", (raw) => {
    expect(() => parseMeasuredCloseInput(raw)).toThrow();
  });
});
