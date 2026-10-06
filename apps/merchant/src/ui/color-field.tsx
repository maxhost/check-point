"use client";

import {
  FieldError,
  Group,
  Input,
  Label,
  Text,
  TextField as AriaTextField,
} from "react-aria-components";
import { cx } from "./cx";
import {
  fieldBox,
  fieldDescription,
  fieldError,
  fieldLabel,
} from "./field-classes";

export type ColorFieldProps = {
  label: string;
  /** Texto libre: la pantalla valida. La muestra usa `value` si es `#RRGGBB`. */
  value: string;
  onChange: (value: string) => void;
  description?: string;
  errorMessage?: string;
  isDisabled?: boolean;
  tourAnchor?: string;
  className?: string;
};

const hex = /^#[0-9a-f]{6}$/i;

/**
 * Spec 0161. Muestra (selector del sistema) + codigo hex editable, una sola variante (owner,
 * 2026-10-05). El hex es el campo con nombre; la muestra lleva su propio `aria-label`.
 */
export function ColorField({
  label,
  value,
  onChange,
  description,
  errorMessage,
  isDisabled,
  tourAnchor,
  className,
}: ColorFieldProps) {
  return (
    <AriaTextField
      value={value}
      onChange={onChange}
      isDisabled={isDisabled}
      maxLength={7}
      validationBehavior="aria"
      isInvalid={errorMessage ? true : undefined}
      data-tour={tourAnchor}
      className={cx("grid gap-1.5", className)}
    >
      <Label className={fieldLabel}>{label}</Label>
      <Group
        isDisabled={isDisabled}
        isInvalid={Boolean(errorMessage)}
        className={({ isInvalid, isFocusVisible, isDisabled }) =>
          cx(
            fieldBox({ isInvalid, isFocusVisible, isDisabled }),
            "flex items-center gap-3 py-1.5 pl-1.5",
          )
        }
      >
        <input
          type="color"
          aria-label={`Elegir color ${label.toLowerCase()}`}
          value={hex.test(value) ? value : "#000000"}
          disabled={isDisabled}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="size-9 shrink-0 cursor-pointer rounded-sm border-0 bg-transparent p-0 disabled:cursor-not-allowed"
        />
        <Input className="min-h-0 min-w-0 flex-1 rounded-none border-0 bg-transparent p-0 font-mono shadow-none text-base text-content uppercase outline-none" />
      </Group>
      {description && (
        <Text slot="description" className={fieldDescription}>
          {description}
        </Text>
      )}
      <FieldError className={fieldError}>{errorMessage}</FieldError>
    </AriaTextField>
  );
}
