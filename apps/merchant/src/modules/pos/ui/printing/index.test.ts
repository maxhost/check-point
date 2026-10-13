import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TicketDoc } from "./ticket/types";

/**
 * Spec 0184 — LA API PUBLICA con navegadores falsos: gesto (la lista de Chrome antes de cualquier
 * espera), memoria dentro de la carga, lista filtrada por nombre tras recargar, trozos BLE,
 * Web Serial recordado, almacenamiento que falla y cada `PrintFailure` desde su causa.
 */

const doc: TicketDoc = {
  businessName: "Cafe",
  table: "Mesa 1",
  lines: [
    { name: "Capuchino", quantity: 2, unitPrice: "$2,50", lineTotal: "$5,00" },
  ],
  total: "$5,00",
  date: "9/10/2026",
  time: "14:05",
  qr: null,
};

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

function fakeBle(name = "BlueTooth Printer") {
  const written: Uint8Array[] = [];
  const characteristic = {
    properties: { write: true, writeWithoutResponse: true },
    writeValueWithResponse: vi.fn(
      async (v: Uint8Array) => void written.push(v),
    ),
    writeValueWithoutResponse: vi.fn(
      async (v: Uint8Array) => void written.push(v),
    ),
  };
  const disconnect = vi.fn();
  const device = {
    name,
    gatt: {
      connect: vi.fn(async () => ({
        getPrimaryService: vi.fn(async (uuid: string) => {
          if (!uuid.startsWith("000018f0"))
            throw new DOMException("x", "NotFoundError");
          return { getCharacteristics: async () => [characteristic] };
        }),
      })),
      disconnect,
    },
  };
  const requestDevice = vi.fn(
    async (options: unknown) => (void options, device),
  );
  return { requestDevice, written, disconnect, characteristic };
}

async function freshModule() {
  vi.resetModules();
  return import("./index");
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout"] });
  vi.stubGlobal("localStorage", memoryStorage());
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Corre la promesa avanzando los `sleep` del transporte BLE. */
async function settle<T>(promise: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return promise;
}

describe("printing (spec 0184)", () => {
  it("sin Bluetooth ni Serial → `unsupported`; con Bluetooth y sin impresora → `no_printer`", async () => {
    vi.stubGlobal("navigator", {});
    let m = await freshModule();
    expect(m.printerSupport()).toEqual({ ble: false, serial: false });
    expect(await m.printTicket(doc)).toMatchObject({
      ok: false,
      reason: "unsupported",
    });

    vi.stubGlobal("navigator", { bluetooth: fakeBle() });
    m = await freshModule();
    expect(await m.printTicket(doc)).toMatchObject({
      ok: false,
      reason: "no_printer",
    });
  });

  it("BLE: elegir guarda el nombre; imprimir otra vez en la misma carga NO abre la lista; trozos ≤ 100 B", async () => {
    const ble = fakeBle();
    vi.stubGlobal("navigator", { bluetooth: ble });
    const m = await freshModule();
    expect(await m.choosePrinter("ble")).toEqual({ ok: true });
    expect(ble.requestDevice).toHaveBeenCalledTimes(1);
    expect(m.getDevicePrinter()).toEqual({
      transport: "ble",
      name: "BlueTooth Printer",
    });

    expect(await settle(m.printTicket(doc))).toEqual({ ok: true });
    expect(await settle(m.printTicket(doc))).toEqual({ ok: true });
    expect(ble.requestDevice).toHaveBeenCalledTimes(1);
    expect(ble.written.length).toBeGreaterThan(1);
    expect(ble.written.every((c) => c.length <= 100)).toBe(true);
    expect(ble.disconnect).toHaveBeenCalledTimes(2);
  });

  it("BLE tras recargar: la lista se pide SINCRONICAMENTE en el toque y filtrada por el nombre guardado", async () => {
    const first = fakeBle();
    vi.stubGlobal("navigator", { bluetooth: first });
    await (await freshModule()).choosePrinter("ble");

    const ble = fakeBle();
    vi.stubGlobal("navigator", { bluetooth: ble });
    const m = await freshModule(); // recarga: el dispositivo en memoria se pierde
    const pending = m.printTicket(doc);
    // Sin un solo `await` de por medio: la lista ya se pidio (gesto del usuario).
    expect(ble.requestDevice).toHaveBeenCalledTimes(1);
    expect(ble.requestDevice.mock.calls[0][0]).toMatchObject({
      filters: [{ name: "BlueTooth Printer" }],
    });
    expect(await settle(pending)).toEqual({ ok: true });
  });

  it("olvidar → la proxima vez `no_printer`, y elegir abre la lista completa", async () => {
    const ble = fakeBle();
    vi.stubGlobal("navigator", { bluetooth: ble });
    const m = await freshModule();
    await m.choosePrinter("ble");
    m.forgetDevicePrinter();
    expect(m.getDevicePrinter()).toBeNull();
    expect(await m.printTicket(doc)).toMatchObject({ reason: "no_printer" });
    await m.choosePrinter("ble");
    expect(ble.requestDevice.mock.calls[1][0]).toMatchObject({
      acceptAllDevices: true,
    });
  });

  it("cada falla sale de su causa: cancelar, no encontrada, escritura", async () => {
    const ble = fakeBle();
    vi.stubGlobal("navigator", { bluetooth: ble });
    let m = await freshModule();
    ble.requestDevice.mockRejectedValueOnce(
      new DOMException(
        "User cancelled the requestDevice() chooser.",
        "NotFoundError",
      ),
    );
    expect(await m.choosePrinter("ble")).toMatchObject({ reason: "cancelled" });

    await m.choosePrinter("ble");
    m = await freshModule();
    ble.requestDevice.mockRejectedValueOnce(
      new DOMException("Bluetooth adapter not available.", "NotFoundError"),
    );
    expect(await m.printTicket(doc)).toMatchObject({ reason: "not_found" });

    ble.characteristic.writeValueWithoutResponse.mockRejectedValueOnce(
      new DOMException("GATT operation failed", "NetworkError"),
    );
    const r = await settle(m.printTicket(doc));
    expect(r).toMatchObject({ ok: false, reason: "write_failed" });
    if (!r.ok) expect(r.message).toMatch(/impresora/);
  });

  it("Web Serial: sin puerto recordado → `no_printer`; con puerto → escribe todo y cierra", async () => {
    const writes: Uint8Array[] = [];
    const port = {
      open: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
      writable: {
        getWriter: () => ({
          write: async (b: Uint8Array) => void writes.push(b),
          releaseLock: () => undefined,
        }),
      } as unknown as WritableStream<Uint8Array>,
    };
    const ports: (typeof port)[] = [];
    const serial = {
      getPorts: vi.fn(async () => ports),
      requestPort: vi.fn(async () => {
        ports.push(port);
        return port;
      }),
    };
    vi.stubGlobal("navigator", { serial });
    const m = await freshModule();
    expect(await m.choosePrinter("serial")).toEqual({ ok: true });
    ports.length = 0;
    expect(await m.printTicket(doc)).toMatchObject({ reason: "no_printer" });
    ports.push(port);
    expect(await m.printTicket(doc)).toEqual({ ok: true });
    expect(port.open).toHaveBeenCalledWith({ baudRate: 9600 });
    expect(writes).toHaveLength(1);
    expect(port.close).toHaveBeenCalled();
  });

  it("localStorage que lanza: elegir e imprimir no rompen (no se recuerda)", async () => {
    const boom = () => {
      throw new DOMException("denied", "SecurityError");
    };
    vi.stubGlobal("localStorage", {
      getItem: boom,
      setItem: boom,
      removeItem: boom,
    });
    vi.stubGlobal("navigator", { bluetooth: fakeBle() });
    const m = await freshModule();
    expect(await m.choosePrinter("ble")).toEqual({ ok: true });
    expect(m.getDevicePrinter()).toBeNull();
    expect(m.getDevicePaper()).toBe(58);
    m.setDevicePaper(80);
    expect(await m.printTicket(doc)).toMatchObject({ reason: "no_printer" });
  });

  it("papel: 58 por defecto, se recuerda el elegido", async () => {
    vi.stubGlobal("navigator", {});
    const m = await freshModule();
    expect(m.getDevicePaper()).toBe(58);
    m.setDevicePaper(80);
    expect((await freshModule()).getDevicePaper()).toBe(80);
  });
});
