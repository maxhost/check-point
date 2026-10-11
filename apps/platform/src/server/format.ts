const DATE = new Intl.DateTimeFormat("es-EC", {
  timeZone: "America/Guayaquil",
  dateStyle: "medium",
});
const DATE_TIME = new Intl.DateTimeFormat("es-EC", {
  timeZone: "America/Guayaquil",
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatDate(value: Date | null): string {
  return value ? DATE.format(value) : "—";
}

export function formatDateTime(value: Date | null): string {
  return value ? DATE_TIME.format(value) : "—";
}

export const ACCESS_LABEL = {
  trial: "En prueba",
  subscribed: "Pagando",
  blocked: "Bloqueado",
} as const;

export const STATUS_LABEL: Record<string, string> = {
  active: "Activo",
  suspended: "Suspendido",
  closed: "Cerrado",
};
