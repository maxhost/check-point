import { describe, it, expect, vi } from "vitest";
import {
  paymentOrder,
  paymentResolved,
  paymentMethods,
  paymentClosed,
} from "../../../../../../tests/e2e/support/pos-measured-payment-fixture";
import {
  MeasuredPaymentSession,
  loadMeasuredPaymentMethods,
} from "./measured-payment-session";
import { PosCache } from "./pos-cache";
import { PosError } from "./pos-types";
import type { PosRequest } from "./pos-context";
import { parseMeasuredCloseInput } from "../server/measured-close-input";
import type { PosOrderV2 } from "../contracts";
function setup(
  close: PosRequest,
  options: {
    onClosed?: (order: PosOrderV2) => void;
    onReview?: (order: PosOrderV2) => void;
    timeoutMs?: number;
  } = {},
) {
  const calls: { url: string; body: unknown }[] = [];
  const request: PosRequest = async <T>(
    url: string,
    method?: string,
    body?: unknown,
  ) => {
    calls.push({ url, body });
    if (url.endsWith("/close")) return close<T>(url, method, body);
    if (url.includes("coupon-state"))
      return { couponState: paymentResolved.couponState } as T;
    if (url.endsWith("/resolve")) return paymentResolved as T;
    return { methods: paymentMethods, defaultMethodId: "cash" } as T;
  };
  const capture = vi.fn(() => request);
  const cache = new PosCache(undefined, request);
  cache.bind("a");
  let seq = 0;
  const session = new MeasuredPaymentSession({ capture, request }, cache, {
    order: paymentOrder,
    historyStatus: "active",
    uuid: () => `uuid-${++seq}`,
    ...options,
  });
  return { session, calls, cache, capture };
}
const closed = paymentClosed(paymentOrder, {
  clientRequestId: "closed",
  version: 1,
  payments: [{ methodId: "cash", amount: "4.01" }],
});
describe("parent-held measured payment command", () => {
  it("recibe el cliente del editor y lo revalida al cobrar, sin volver a resolver el pase", async () => {
    const { session, calls } = setup(async <T>() => closed as T);
    expect(
      session.acceptEditorCustomer({
        resolved: paymentResolved,
        excluded: true,
      }),
    ).toBe(true);
    await session.prepare();
    await session.confirm();
    expect(calls.some((call) => call.url.endsWith("/resolve"))).toBe(false);
    expect(calls.some((call) => call.url.includes("coupon-state"))).toBe(true);
    const body = calls.find((call) => call.url.endsWith("/close"))?.body;
    expect(body).toMatchObject({ membershipId: paymentResolved.membership.id });
    expect(body).not.toHaveProperty("coupon");
    expect(
      session.acceptEditorCustomer({ resolved: null, excluded: false }),
    ).toBe(false);
  });

  it("freezes deeply once; ambiguity followed by 4xx stays uncertain, explicit identical retry succeeds once", async () => {
    let count = 0;
    const { session, calls, capture } = setup(async <T>() => {
      count++;
      if (count === 1) throw new Error("lost");
      if (count === 2)
        throw new PosError(
          "version",
          "version_conflict",
          undefined,
          undefined,
          409,
        );
      return closed as T;
    });
    await session.prepare();
    await session.confirm();
    expect(session.getSnapshot().phase).toBe("closeUncertain");
    expect(session.canLeave).toBe(false);
    session.cancelDialog();
    session.removeCustomer();
    session.startScan();
    await session.confirm();
    expect(count).toBe(1);
    await session.retry();
    expect(session.getSnapshot().phase).toBe("closeUncertain");
    await session.retry();
    expect(session.getSnapshot().phase).toBe("closed");
    const attempts = calls.filter((call) => call.url.endsWith("/close"));
    expect(attempts).toHaveLength(3);
    expect(attempts[0].body).toBe(attempts[2].body);
    expect(Object.isFrozen(attempts[0].body)).toBe(true);
    expect(
      Object.isFrozen(
        (attempts[0].body as { payments: unknown[] }).payments[0],
      ),
    ).toBe(true);
    expect(capture).toHaveBeenCalledTimes(2);
  });
  it("double click sends one, callback throw cannot undo canonical success", async () => {
    let finish!: (value: PosOrderV2) => void;
    const onClosed = vi.fn(() => {
      throw new Error("printing");
    });
    const { session, calls } = setup(
      () =>
        new Promise((resolve) => {
          finish = resolve as typeof finish;
        }),
      { onClosed },
    );
    await session.prepare();
    const first = session.confirm();
    const second = session.confirm();
    expect(first).toBe(second);
    finish(closed);
    await first;
    expect(session.getSnapshot().phase).toBe("closed");
    await session.confirm();
    await session.retry();
    expect(calls.filter((call) => call.url.endsWith("/close"))).toHaveLength(1);
    expect(onClosed).toHaveBeenCalledTimes(1);
  });
  it("requires explicit parent review of same order and never auto closes another version", async () => {
    const newer = { ...paymentOrder, version: 2 };
    const onReview = vi.fn();
    const { session, calls } = setup(
      async () => {
        throw new PosError(
          "changed",
          "version_conflict",
          undefined,
          undefined,
          409,
          { order: newer },
        );
      },
      { onReview },
    );
    await session.prepare();
    await session.confirm();
    expect(onReview).toHaveBeenCalledWith(newer);
    session.acceptReviewedOrder({ ...newer, id: "other" });
    expect(session.getSnapshot().order.version).toBe(1);
    session.acceptReviewedOrder(newer);
    expect(session.getSnapshot().order.version).toBe(2);
    await session.confirm();
    expect(calls.filter((call) => call.url.endsWith("/close"))).toHaveLength(1);
  });
  it("wrong-order DTO and timeout are ambiguous; real identity discards late response", async () => {
    const a = setup(async <T>() => ({ ...closed, id: "other" }) as T);
    await a.session.prepare();
    await a.session.confirm();
    expect(a.session.getSnapshot().phase).toBe("closeUncertain");
    let finish!: (value: PosOrderV2) => void;
    const onClosed = vi.fn();
    const b = setup(
      () =>
        new Promise((resolve) => {
          finish = resolve as typeof finish;
        }),
      { onClosed, timeoutMs: 5 },
    );
    await b.session.prepare();
    await b.session.confirm();
    expect(b.session.getSnapshot().phase).toBe("closeUncertain");
    b.cache.bind("b");
    finish(closed);
    await b.session.retry();
    expect(b.session.getSnapshot().phase).toBe("retired");
    expect(onClosed).not.toHaveBeenCalled();
  });
  it("prepared session cannot capture a new identity even without parent retirement", async () => {
    const { session, cache, calls } = setup(async <T>() => closed as T);
    await session.prepare();
    cache.bind("b");
    await session.confirm();
    expect(session.getSnapshot().phase).toBe("retired");
    expect(calls.filter((call) => call.url.endsWith("/close"))).toHaveLength(0);
  });
  it("late person A cannot replace explicitly scanned person B", async () => {
    let resolveA!: (value: typeof paymentResolved) => void;
    let count = 0;
    const request: PosRequest = async <T>() => {
      count++;
      return (
        count === 1
          ? await new Promise<typeof paymentResolved>((resolve) => {
              resolveA = resolve;
            })
          : {
              ...paymentResolved,
              consumer: { displayName: "Bea" },
              membership: { ...paymentResolved.membership, id: "b" },
            }
      ) as T;
    };
    const cache = new PosCache(undefined, request);
    cache.bind("a");
    const session = new MeasuredPaymentSession(
      { request, capture: () => request },
      cache,
      { order: paymentOrder, historyStatus: "active" },
    );
    session.startScan();
    const a = session.resolve("a");
    session.startScan();
    await session.resolve("b");
    resolveA(paymentResolved);
    await a;
    expect(session.getSnapshot().resolved?.consumer.displayName).toBe("Bea");
  });
  it("actual emitted wire passes strict HTTP parser and server assigns payment id", async () => {
    const methodId = "123e4567-e89b-42d3-a456-426614174000";
    let wire: unknown;
    const request: PosRequest = async <T>(
      url: string,
      _method?: string,
      body?: unknown,
    ) => {
      if (url.endsWith("/close")) {
        wire = body;
        parseMeasuredCloseInput(body);
        return closed as T;
      }
      return {
        methods: [{ ...paymentMethods[0], id: methodId }],
        defaultMethodId: methodId,
      } as T;
    };
    const cache = new PosCache(undefined, request);
    cache.bind("a");
    const session = new MeasuredPaymentSession(
      { request, capture: () => request },
      cache,
      {
        order: paymentOrder,
        historyStatus: "active",
        uuid: () => "123e4567-e89b-42d3-a456-426614174001",
      },
    );
    await session.prepare();
    await session.confirm();
    expect(session.getSnapshot().phase).toBe("closed");
    const parsed = parseMeasuredCloseInput(wire);
    expect(parsed.payments).toHaveLength(1);
    expect(parsed.payments[0].paymentId).toBeTypeOf("string");
    expect((wire as { payments: unknown[] }).payments[0]).toEqual({
      methodId,
      amount: "4.01",
    });
  });
  it("403 after ambiguity retains the identical request and uncertain state", async () => {
    let count = 0;
    const { session, calls } = setup(async <T>() => {
      count++;
      if (count === 1) throw new Error("lost");
      if (count === 2)
        throw new PosError("Denied", undefined, undefined, undefined, 403);
      return closed as T;
    });
    await session.prepare();
    await session.confirm();
    await session.retry();
    expect(session.getSnapshot().phase).toBe("closeUncertain");
    expect(session.canLeave).toBe(false);
    await session.retry();
    expect(session.getSnapshot().phase).toBe("closed");
    const attempts = calls.filter((call) => call.url.endsWith("/close"));
    expect(attempts[0].body).toBe(attempts[2].body);
  });
  it("identity withdrawal during review publication discards parent callback", async () => {
    const onReview = vi.fn();
    const { session } = setup(async <T>() => paymentOrder as T, { onReview });
    session.subscribe(() => {
      if (session.getSnapshot().phase === "review") session.retireIdentity();
    });
    await session.prepare();
    await session.confirm();
    expect(onReview).not.toHaveBeenCalled();
    expect(session.getSnapshot().phase).toBe("retired");
  });
  it.each([408, 500, 503])("HTTP %s remains ambiguous", async (status) => {
    const { session } = setup(async () => {
      throw new PosError(
        "unavailable",
        undefined,
        undefined,
        undefined,
        status,
      );
    });
    await session.prepare();
    await session.confirm();
    expect(session.getSnapshot().phase).toBe("closeUncertain");
  });
  it("unreadable success is uncertain", async () => {
    const { session } = setup(async <T>() => null as T);
    await session.prepare();
    await session.confirm();
    expect(session.getSnapshot().phase).toBe("closeUncertain");
  });
  it("failed explicit scan cannot silently become anonymous", async () => {
    const request: PosRequest = async () => {
      throw new PosError(
        "Programa no disponible",
        "no_program",
        undefined,
        undefined,
        422,
      );
    };
    const cache = new PosCache(undefined, request);
    cache.bind("a");
    const session = new MeasuredPaymentSession(
      { request, capture: () => request },
      cache,
      { order: paymentOrder, historyStatus: "active" },
    );
    session.startScan();
    await session.resolve("qr");
    session.cancelDialog();
    await session.prepare();
    expect(session.getSnapshot().customerReview).toBe(true);
    expect(session.getSnapshot().validated).toBe(false);
    session.removeCustomer();
    expect(session.getSnapshot().customerReview).toBe(false);
  });
  it("net zero does not request methods or fabricate payment", async () => {
    const { session, calls } = setup(
      async <T>() =>
        paymentClosed(session.getSnapshot().order, {
          clientRequestId: "zero",
          version: 1,
          payments: [],
        }) as T,
    );
    session.getSnapshot().order.items.forEach((line) => {
      line.unitPrice = "0";
    });
    await session.prepare();
    await session.confirm();
    expect(calls.some((call) => call.url.endsWith("payment-methods"))).toBe(
      false,
    );
    expect(
      calls.find((call) => call.url.endsWith("/close"))?.body,
    ).toMatchObject({ payments: [] });
  });
});

it("reuses prefetched methods between checkout openings and orders, and clears them with identity", async () => {
  const { session, cache, calls } = setup(async <T>() => closed as T);
  await Promise.all([
    loadMeasuredPaymentMethods(cache, session.client),
    loadMeasuredPaymentMethods(cache, session.client),
  ]);
  await session.prepare();
  session.cancelDialog();
  await session.prepare();
  const another = new MeasuredPaymentSession(session.client, cache, {
    order: { ...paymentOrder, id: "another" },
    historyStatus: "active",
  });
  expect(another.getSnapshot().methods).toEqual(paymentMethods);
  await another.prepare();
  expect(
    calls.filter((call) => call.url.endsWith("/payment-methods")),
  ).toHaveLength(1);
  cache.bind("another-identity");
  const fresh = new MeasuredPaymentSession(session.client, cache, {
    order: paymentOrder,
    historyStatus: "active",
  });
  expect(fresh.getSnapshot().methods).toEqual([]);
  await fresh.prepare();
  expect(
    calls.filter((call) => call.url.endsWith("/payment-methods")),
  ).toHaveLength(2);
});
