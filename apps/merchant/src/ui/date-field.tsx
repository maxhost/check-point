"use client";

import { DateTimeField, type DateTimeFieldProps } from "./date-time-field";

export type DateFieldProps = Omit<
  DateTimeFieldProps,
  "granularity" | "value" | "min"
> & {
  /** Día calendario `YYYY-MM-DD`, sin hora ni zona; `""` = vacío. */
  value: string;
  /** Día mínimo permitido, en el mismo formato. Sin mínimo admite días pasados. */
  min?: string;
};

/** Segmentos editables y calendario del kit para un día local, sin conversión UTC. */
export function DateField(props: DateFieldProps) {
  return <DateTimeField {...props} granularity="day" />;
}
