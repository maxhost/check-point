import { describe, expect, it, vi } from "vitest";
import type { DbTransaction } from "@mi-pasaporte/db";
import { defineEventSubscription } from "./types";

describe("generic event decoder dispatch", () => {
  it("passes envelope version to the consumer decoder without interpreting a non-sale as sale.closed", async () => {
    const handler = vi.fn(async () => {});
    const decode = vi.fn((value: unknown, version: number) => {
      if (
        version !== 3 ||
        typeof value !== "object" ||
        value === null ||
        !("value" in value)
      )
        throw new Error("Unsupported demo event");
      return { value: String(value.value) };
    });
    const subscription = defineEventSubscription({
      eventType: "demo.changed",
      resourceType: "demo",
      slot: "test",
      requiredModules: [],
      decode,
      handler,
    });
    const tx = {} as DbTransaction;
    await subscription.dispatch(tx, {
      id: "event",
      businessId: "business",
      eventVersion: 3,
      payload: { value: "complete snapshot" },
    });
    expect(decode).toHaveBeenCalledWith({ value: "complete snapshot" }, 3);
    expect(handler).toHaveBeenCalledWith(tx, {
      id: "event",
      businessId: "business",
      payload: { value: "complete snapshot" },
    });
    await expect(
      subscription.dispatch(tx, {
        id: "event",
        businessId: "business",
        eventVersion: 99,
        payload: { value: "snapshot" },
      }),
    ).rejects.toThrow("Unsupported demo event");
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
