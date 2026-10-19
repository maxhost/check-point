import { describe, expect, it, vi } from "vitest";
import { MeasuredCustomerModel } from "./measured-customer-model";
import { PosCache } from "./pos-cache";
import { PosError } from "./pos-types";
import type { PosRequest } from "./pos-context";
import { paymentResolved } from "../../../../../../tests/e2e/support/pos-measured-payment-fixture";

function setup(request: PosRequest) {
  const cache = new PosCache();
  cache.bind("a");
  const capture = vi.fn(() => request);
  const customer: MeasuredCustomerModel = new MeasuredCustomerModel(
    { capture, request },
    cache,
    vi.fn(),
    () => !customer.state.resolving,
  );
  return { customer, cache, capture };
}
describe("editor customer identification", () => {
  it("identifica sin crear una orden y captura local/cuerpo antes del await", async () => {
    const calls = vi.fn();
    const request: PosRequest = async <T>(...args: Parameters<PosRequest>) => {
      calls(...args);
      return paymentResolved as T;
    };
    const { customer, capture } = setup(request);
    customer.start();
    await customer.resolve("qr", "north");
    expect(capture).toHaveBeenCalledOnce();
    expect(calls).toHaveBeenCalledExactlyOnceWith(
      "/api/modules/pos/resolve",
      "POST",
      { qrToken: "qr", locationId: "north" },
    );
    expect(Object.isFrozen(calls.mock.calls[0][2])).toBe(true);
    expect(customer.state.resolved).toEqual(paymentResolved);
    expect(customer.state.scanning).toBe(false);
  });
  it("cancelar conserva cliente anterior y descarta resolución tardía y doble escaneo", async () => {
    let finish!: (value: unknown) => void;
    const calls = vi.fn();
    const request: PosRequest = <T>(...args: Parameters<PosRequest>) => {
      calls(...args);
      return new Promise<T>((resolve) => {
        finish = (value) => resolve(value as T);
      });
    };
    const { customer } = setup(request);
    customer.adopt({ resolved: paymentResolved, excluded: true });
    customer.start();
    const pending = customer.resolve("late", "north");
    await customer.resolve("double", "north");
    customer.cancel();
    finish({ ...paymentResolved, consumer: { displayName: "Otro" } });
    await pending;
    expect(calls).toHaveBeenCalledOnce();
    expect(customer.selection).toEqual({
      resolved: paymentResolved,
      excluded: true,
    });
  });
  it.each([401, 403])(
    "retira selección al recibir acceso %s",
    async (status) => {
      const { customer } = setup(async () => {
        throw new PosError("Acceso", "access", undefined, undefined, status);
      });
      customer.adopt({ resolved: paymentResolved, excluded: false });
      customer.start();
      await customer.resolve("qr", "north");
      expect(customer.isRetired).toBe(true);
      expect(customer.state.resolved).toBeNull();
    },
  );
  it("un cambio de epoch impide aplicar una respuesta de otra identidad", async () => {
    let finish!: (value: unknown) => void;
    const { customer, cache } = setup(
      <T>() =>
        new Promise<T>((resolve) => {
          finish = (value) => resolve(value as T);
        }),
    );
    customer.start();
    const pending = customer.resolve("qr", "north");
    cache.bind("b");
    finish(paymentResolved);
    await pending;
    expect(customer.isRetired).toBe(true);
    expect(customer.state.resolved).toBeNull();
    expect(customer.state.resolving).toBe(false);
  });
});
