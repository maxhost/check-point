export type Method = "clasico" | "ble";
export type Result = { ok: boolean; title: string; detail: string };

const COUNT_KEY = "checkpass-prueba-impresora-n";

export function readCount(): number {
  try {
    return Number(localStorage.getItem(COUNT_KEY) ?? "0") || 0;
  } catch {
    return 0;
  }
}

export function saveCount(value: number) {
  try {
    localStorage.setItem(COUNT_KEY, String(value));
  } catch {
    // Sin almacenamiento el contador vuelve a 1: no afecta la prueba.
  }
}

/** Sin acentos: la tabla de caracteres de una termica generica no esta garantizada. */
export function ticket(
  n: number,
  method: Method,
  remembered: boolean,
): Uint8Array {
  const now = new Date().toLocaleString("es-MX");
  const text = [
    "\x1b@", // inicializa la impresora
    "\x1ba\x01", // centrado
    "\x1bE\x01CHECKPASS CLUB\x1bE\x00\n",
    "Prueba de impresora\n",
    "--------------------------------\n",
    "\x1bE\x01SI LEES ESTO, FUNCIONO\x1bE\x00\n",
    "--------------------------------\n",
    `Prueba numero ${n}\n`,
    `Metodo: ${method === "clasico" ? "1 (Bluetooth clasico)" : "2 (BLE)"}\n`,
    method === "clasico"
      ? `Impresora recordada: ${remembered ? "SI" : "NO"}\n`
      : "",
    `${now}\n`,
    "\x1bd\x04", // avanza 4 lineas para poder cortar el papel
  ].join("");
  return new TextEncoder().encode(text);
}

export function explain(error: unknown, method: Method): Result {
  const name = error instanceof DOMException ? error.name : "";
  const message = error instanceof Error ? error.message : String(error);
  if (name === "NotFoundError")
    return {
      ok: false,
      title: "No se eligió ninguna impresora",
      detail:
        method === "clasico"
          ? "La lista salió vacía o la cerraste. Mira el problema 2 más abajo."
          : "Cerraste la lista o la impresora no apareció. Mira el problema 2 más abajo.",
    };
  if (name === "SecurityError" || name === "NotAllowedError")
    return {
      ok: false,
      title: "Chrome no tiene permiso",
      detail:
        "Falta el permiso de «Dispositivos cercanos» o el sitio quedó bloqueado. Mira el problema 1 más abajo.",
    };
  if (name === "NotSupportedError")
    return {
      ok: false,
      title: "Ese dispositivo no acepta impresiones por este método",
      detail: `Puede que elegiste otro aparato, o que la impresora use otro sistema. Mándale igual la captura. (${message})`,
    };
  if (name === "NetworkError" || name === "InvalidStateError")
    return {
      ok: false,
      title: "No se pudo conectar con la impresora",
      detail:
        "Puede estar apagada, lejos, sin papel o conectada a otra app. Mira el problema 3 más abajo.",
    };
  return {
    ok: false,
    title: "Error inesperado",
    detail: `${name || "Error"}: ${message}`,
  };
}
