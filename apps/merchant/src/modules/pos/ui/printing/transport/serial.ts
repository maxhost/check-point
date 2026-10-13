import { PrintError } from "./types";

/**
 * Spec 0184 — WEB SERIAL (Bluetooth clasico, perfil SPP). Chrome Android RECUERDA el puerto
 * elegido (`getPorts()`), asi que despues de la primera vez imprime sin lista. Sin medir contra
 * una impresora real (la del comercio de prueba es BLE): spec 0184 §Declarado afuera.
 * Se cierra el puerto en cada impresion para no dejar la impresora tomada (SPP admite una
 * conexion a la vez).
 */
const SPP_UUID = "00001101-0000-1000-8000-00805f9b34fb";
const BAUD_RATE = 9600;

/** Tipos minimos de Web Serial: el `lib.dom` del repo no los trae. */
export type SerialPortLike = {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readonly writable: WritableStream<Uint8Array> | null;
};
export type SerialLike = {
  getPorts(): Promise<SerialPortLike[]>;
  requestPort(options?: {
    filters?: { bluetoothServiceClassId?: string }[];
    allowedBluetoothServiceClassIds?: string[];
  }): Promise<SerialPortLike>;
};

export function serialApi(): SerialLike | null {
  if (typeof navigator === "undefined") return null;
  return (navigator as Navigator & { serial?: SerialLike }).serial ?? null;
}

/** La lista de Chrome (solo SPP). Web Serial no da el nombre del equipo: se guarda uno generico. */
export async function chooseSerial(serial: SerialLike): Promise<string> {
  await serial.requestPort({
    filters: [{ bluetoothServiceClassId: SPP_UUID }],
    allowedBluetoothServiceClassIds: [SPP_UUID],
  });
  return "Impresora Bluetooth";
}

export async function printSerial(
  serial: SerialLike,
  bytes: Uint8Array,
): Promise<void> {
  const [port] = await serial.getPorts();
  if (!port)
    throw new PrintError("no_printer", "Elige la impresora antes de imprimir.");
  await port.open({ baudRate: BAUD_RATE });
  try {
    const writer = port.writable?.getWriter();
    if (!writer)
      throw new PrintError("write_failed", "La impresora no acepta datos.");
    try {
      await writer.write(bytes);
    } finally {
      writer.releaseLock();
    }
  } finally {
    await port.close().catch(() => undefined);
  }
}
