/**
 * Metodo 2 de la prueba: Web Bluetooth (BLE). Sirve para saber si la impresora es BLE —las BLE
 * no aparecen en la lista de Web Serial, que solo muestra lo vinculado por Bluetooth clasico—.
 * Los servicios son los que exponen las termicas genericas conocidas (perfiles de
 * `@point-of-sale/webbluetooth-receipt-printer` y del SDK de la PT-210).
 */
const PRINTER_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "0000fee7-0000-1000-8000-00805f9b34fb",
  "0000ae30-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
];
const CHUNK = 100;

/** Tipos minimos de Web Bluetooth: el `lib.dom` del repo no los trae. */
type Characteristic = {
  properties: { write: boolean; writeWithoutResponse: boolean };
  writeValueWithResponse(value: Uint8Array): Promise<void>;
  writeValueWithoutResponse(value: Uint8Array): Promise<void>;
};
type Service = { getCharacteristics(): Promise<Characteristic[]> };
type GattServer = {
  getPrimaryService(uuid: string): Promise<Service>;
};
export type BleDevice = {
  name?: string;
  gatt?: { connect(): Promise<GattServer>; disconnect(): void };
};
type BluetoothLike = {
  requestDevice(options: {
    acceptAllDevices: boolean;
    optionalServices: string[];
  }): Promise<BleDevice>;
};

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

export function bluetoothApi(): BluetoothLike | null {
  if (typeof navigator === "undefined") return null;
  return (
    (navigator as Navigator & { bluetooth?: BluetoothLike }).bluetooth ?? null
  );
}

/** La lista de Chrome: se llama PRIMERO en el toque, antes de cualquier otra espera. */
export function requestBlePrinter(bluetooth: BluetoothLike) {
  return bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: PRINTER_SERVICES,
  });
}

/** Escribe el ticket en el primer servicio conocido con una caracteristica escribible.
 * Devuelve el servicio usado, que es el dato que interesa del diagnostico. */
export async function writeBle(
  device: BleDevice,
  bytes: Uint8Array,
  onFound: (found: string[]) => void = () => undefined,
): Promise<string> {
  if (!device.gatt)
    throw new DOMException("El dispositivo no tiene GATT", "NotSupportedError");
  const server = await device.gatt.connect();
  const found: string[] = [];
  try {
    for (const uuid of PRINTER_SERVICES) {
      const service = await server.getPrimaryService(uuid).catch(() => null);
      if (!service) continue;
      const characteristics = await service.getCharacteristics();
      found.push(
        `${uuid.slice(0, 8)}: ${characteristics
          .map(
            (item) =>
              [
                item.properties.write ? "w" : "",
                item.properties.writeWithoutResponse ? "wnr" : "",
              ].join("") || "ro",
          )
          .join(",")}`,
      );
      const target = characteristics.find(
        (item) => item.properties.writeWithoutResponse || item.properties.write,
      );
      if (!target) continue;
      for (let start = 0; start < bytes.length; start += CHUNK) {
        const chunk = bytes.slice(start, start + CHUNK);
        if (target.properties.writeWithoutResponse)
          await target.writeValueWithoutResponse(chunk);
        else await target.writeValueWithResponse(chunk);
        await sleep(30);
      }
      // Margen para que salga lo escrito sin respuesta antes de desconectar.
      await sleep(400);
      onFound(found);
      return uuid.endsWith("-0000-1000-8000-00805f9b34fb")
        ? uuid.slice(4, 8)
        : uuid.slice(0, 8);
    }
    onFound(found);
    throw new DOMException(
      "No tiene un servicio de impresion conocido",
      "NotSupportedError",
    );
  } finally {
    device.gatt.disconnect();
  }
}
