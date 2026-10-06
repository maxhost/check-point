import { cx } from "./cx";

// Spec 0161: las clases de `TextField` que comparten los campos que no son un `Input` simple
// (grupo de segmentos, hex con muestra, buscador). No se exporta desde `ui/index.ts`.
export const fieldLabel =
  "cp-field-label text-base font-bold leading-5 text-content";
export const fieldDescription = "text-sm leading-5 text-content-muted";
export const fieldError = "text-sm font-semibold leading-5 text-danger";

export function fieldBox({
  isInvalid,
  isFocusVisible,
  isDisabled,
}: {
  isInvalid?: boolean;
  isFocusVisible?: boolean;
  isDisabled?: boolean;
}) {
  return cx(
    "min-h-12 w-full rounded-md border bg-surface px-3.5 py-2.5 text-base text-content outline-none",
    isInvalid ? "border-danger" : "border-border-strong",
    isFocusVisible && "outline-2 outline-offset-2 outline-focus",
    isDisabled &&
      "cursor-not-allowed border-disabled bg-disabled text-on-disabled",
  );
}

// Los separadores (`/`, `,`, `:`) sin padding: se leen como «15/10/2026, 09:30».
export const segmentClasses = ({
  type,
  isFocused,
  isPlaceholder,
}: {
  type: string;
  isFocused: boolean;
  isPlaceholder: boolean;
}) =>
  cx(
    "rounded-sm tabular-nums outline-none",
    type === "literal" ? "whitespace-pre" : "px-px",
    isPlaceholder && "text-content-muted",
    isFocused && "bg-primary text-on-primary",
  );
