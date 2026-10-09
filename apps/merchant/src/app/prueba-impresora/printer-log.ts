/** Una sesion por carga de pagina: junta en el log todo lo que hizo una misma persona. */
const session = Math.random().toString(36).slice(2, 8);

type LogData = {
  detail?: unknown;
  error?: unknown;
  device?: string;
  service?: string;
};

function describe(error: unknown) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

/** Avisa al servidor lo que paso. Nunca falla ni demora la prueba. */
export function logEvent(event: string, data: LogData = {}) {
  try {
    void fetch("/api/prueba-impresora/log", {
      method: "POST",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        session,
        event,
        chrome: navigator.userAgent.match(/Chrome\/([\d.]+)/)?.[1] ?? "-",
        ua: navigator.userAgent,
        ...data,
        ...(data.error === undefined ? {} : { error: describe(data.error) }),
      }),
    }).catch(() => undefined);
  } catch {
    // Sin red el registro se pierde: la prueba sigue igual.
  }
}
