import { PrintError } from "./types";

/**
 * Spec 0184 — WEB BLUETOOTH (BLE). Medido en campo (2026-10-09): la WD-58P1 expone `18f0` con una
 * caracteristica escribible con y sin respuesta, e imprimio con trozos de 100 B cada 30 ms.
 *
 * - El dispositivo elegido queda en MEMORIA del modulo: dentro de la misma carga de la pagina,
 *   imprimir otra vez no abre la lista de Chrome.
 * - Tras recargar, la lista se abre FILTRADA por el nombre guardado: un renglon, un toque.
 *   (`getDevices()`, que la recordaria sin preguntar, sigue detras de flag en Chrome.)
 * - `requestDevice` es SIEMPRE lo primero que se espera: Chrome exige el gesto del usuario.
 */
export const PRINTER_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "0000fee7-0000-1000-8000-00805f9b34fb",
  "0000ae30-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
];
export const BLE_CHUNK = 100;
const CHUNK_PAUSE_MS = 30;
const DRAIN_MS = 400;

/** Tipos minimos de Web Bluetooth: el `lib.dom` del repo no los trae. */
type Characteristic = {
  properties: { write: boolean; writeWithoutResponse: boolean };
  writeValueWithResponse(value: Uint8Array): Promise<void>;
  writeValueWithoutResponse(value: Uint8Array): Promise<void>;
};
type GattServer = {
  getPrimaryService(
    uuid: string,
  ): Promise<{ getCharacteristics(): Promise<Characteristic[]> }>;
};
export type BleDevice = {
  name?: string;
  gatt?: { connect(): Promise<GattServer>; disconnect(): void };
};
export type BluetoothLike = {
  requestDevice(
    options:
      | { acceptAllDevices: true; optionalServices: string[] }
      | { filters: { name: string }[]; optionalServices: string[] },
  ): Promise<BleDevice>;
};

let remembered: BleDevice | null = null;

export function bluetoothApi(): BluetoothLike | null {
  if (typeof navigator === "undefined") return null;
  return (
    (navigator as Navigator & { bluetooth?: BluetoothLike }).bluetooth ?? null
  );
}

/** La lista completa de Chrome. Devuelve el nombre para guardarlo en el dispositivo. */
export async function chooseBle(bluetooth: BluetoothLike): Promise<string> {
  const device = await bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: PRINTER_SERVICES,
  });
  remembered = device;
  return device.name ?? "";
}

export async function printBle(
  bluetooth: BluetoothLike,
  savedName: string,
  bytes: Uint8Array,
): Promise<void> {
  const device =
    remembered && (remembered.name ?? "") === savedName
      ? remembered
      : await bluetooth.requestDevice(
          savedName
            ? { filters: [{ name: savedName }], optionalServices: PRINTER_SERVICES }
            : { acceptAllDevices: true, optionalServices: PRINTER_SERVICES },
        );
  remembered = device;
  await writeBle(device, bytes);
}

export function forgetBle(): void {
  remembered = null;
}

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

/** Escribe en el primer servicio conocido con una caracteristica escribible y desconecta. */
async function writeBle(device: BleDevice, bytes: Uint8Array): Promise<void> {
  if (!device.gatt)
    throw new PrintError("write_failed", "Ese dispositivo no es una impresora.");
  const server = await device.gatt.connect();
  try {
    for (const uuid of PRINTER_SERVICES) {
      const service = await server.getPrimaryService(uuid).catch(() => null);
      if (!service) continue;
      const target = (await service.getCharacteristics()).find(
        (item) => item.properties.writeWithoutResponse || item.properties.write,
      );
      if (!target) continue;
      for (let start = 0; start < bytes.length; start += BLE_CHUNK) {
        const chunk = bytes.slice(start, start + BLE_CHUNK);
        if (target.properties.writeWithoutResponse)
          await target.writeValueWithoutResponse(chunk);
        else await target.writeValueWithResponse(chunk);
        await sleep(CHUNK_PAUSE_MS);
      }
      // Margen para que salga lo escrito sin respuesta antes de desconectar.
      await sleep(DRAIN_MS);
      return;
    }
    throw new PrintError(
      "write_failed",
      "Ese dispositivo no se comporta como una impresora de tickets.",
    );
  } finally {
    device.gatt.disconnect();
  }
}
