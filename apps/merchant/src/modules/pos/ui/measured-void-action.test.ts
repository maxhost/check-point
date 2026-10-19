import { describe, expect, it, vi } from "vitest";
import {
  MeasuredVoidAction,
  measuredVoidOwner,
  mountMeasuredVoidOwner,
  retireMeasuredVoidIdentity,
} from "./measured-void-action";
import { PosError } from "./pos-types";
import { actionOpen } from "../../../../../../tests/e2e/support/pos-console-actions-fixture";
import type { PosClient } from "./pos-context";
import { historyKey } from "./pos-cache";
const order = structuredClone(actionOpen);
const terminal = {
  ...order,
  status: "voided" as const,
  closedAt: new Date().toISOString(),
};
function setup(timeout = 15000) {
  const request = vi.fn<PosClient["request"]>();
  const transport: PosClient["request"] = <T>(
    ...args: Parameters<PosClient["request"]>
  ) => request(...args) as Promise<T>;
  const capture = vi.fn(() => transport);
  const client: PosClient = { request: transport, capture };
  const action = new MeasuredVoidAction(
    "test",
    client,
    "America/Guayaquil",
    timeout,
  );
  return { action, request, capture, client };
}
describe("console void owner", () => {
  it("captures once before awaiting, double tap shares promise, canonical result patches history without reads", async () => {
    const { action, request, capture } = setup();
    let release!: (value: typeof terminal) => void;
    request.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }) as never,
    );
    action.cache.put(historyKey, {
      open: [{ ...order, lineCount: 1, saleTotal: null }],
      closedToday: [],
    });
    const first = action.confirm(order);
    expect(action.confirm({ ...order, version: 9 })).toBe(first);
    expect(capture).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(
      `/api/modules/pos/orders/${order.id}/void`,
      "POST",
      { version: order.version },
    );
    expect(Object.isFrozen(request.mock.calls[0][2])).toBe(true);
    release(terminal);
    await first;
    expect(action.getSnapshot().phase).toBe("confirmed");
    expect(action.cache.peek(historyKey, true)).toMatchObject({
      open: [],
      closedToday: [{ status: "voided" }],
    });
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("uncertainty survives 403 recovery and uses identical body and transport", async () => {
    const { action, request, capture } = setup();
    request.mockRejectedValueOnce(new Error("lost response"));
    request.mockRejectedValueOnce(
      new PosError("denied", undefined, undefined, undefined, 403),
    );
    request.mockResolvedValueOnce(terminal);
    await action.confirm(order);
    const body = request.mock.calls[0][2];
    expect(action.canLeave).toBe(false);
    await action.confirm({ ...order, id: "other" });
    expect(request).toHaveBeenCalledTimes(1);
    await action.retry();
    expect(action.getSnapshot().phase).toBe("uncertain");
    expect(action.canLeave).toBe(false);
    await action.retry();
    expect(capture).toHaveBeenCalledTimes(1);
    expect(request.mock.calls.every((call) => call[2] === body)).toBe(true);
    expect(action.getSnapshot().order).toEqual(terminal);
  });
  it("timeout and noncanonical responses remain uncertain", async () => {
    const { action, request } = setup(5);
    request.mockImplementationOnce(() => new Promise(() => {}));
    await action.confirm(order);
    expect(action.getSnapshot().phase).toBe("uncertain");
    request.mockResolvedValueOnce({ ...terminal, id: "wrong" });
    await action.retry();
    expect(action.getSnapshot().phase).toBe("uncertain");
  });
  it("conflict requires explicit review without retrying the command", async () => {
    const { action, request } = setup();
    request.mockRejectedValueOnce(
      new PosError("stale", "version_conflict", undefined, undefined, 409),
    );
    await action.confirm(order);
    expect(action.canLeave).toBe(false);
    await action.retry();
    expect(request).toHaveBeenCalledTimes(1);
    request.mockResolvedValueOnce({ ...order, version: 2 });
    await action.review();
    expect(request.mock.calls[1]).toEqual([
      `/api/modules/pos/orders/${order.id}`,
    ]);
    expect(action.getSnapshot()).toMatchObject({
      phase: "idle",
      order: { version: 2 },
    });
  });
  it("same identity remount keeps owner/cache; another identity retires late callback", async () => {
    const { request, client } = setup();
    const action = measuredVoidOwner("remount-a", client, "UTC");
    const unmount = mountMeasuredVoidOwner(action);
    let release!: (value: typeof terminal) => void;
    request.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }) as never,
    );
    const pending = action.confirm(order);
    unmount();
    await Promise.resolve();
    expect(measuredVoidOwner("remount-a", client, "UTC")).toBe(action);
    const other = measuredVoidOwner("remount-b", client, "UTC");
    expect(action.getSnapshot().phase).toBe("retired");
    release(terminal);
    await pending;
    expect(other.getSnapshot().order).toBeNull();
    retireMeasuredVoidIdentity("remount-b");
  });
  for (const error of [
    new PosError("unauthorized", undefined, undefined, undefined, 401),
    new PosError(
      "scope",
      "backoffice_context_changed",
      undefined,
      undefined,
      409,
    ),
  ])
    it(`real withdrawal retires (${error.message})`, async () => {
      const { action, request } = setup();
      request.mockRejectedValueOnce(new Error("lost"));
      request.mockRejectedValueOnce(error);
      await action.confirm(order);
      await action.retry();
      expect(action.getSnapshot().phase).toBe("retired");
      expect(action.cache.context).toBeNull();
    });
});
