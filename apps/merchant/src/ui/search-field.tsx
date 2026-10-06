"use client";

import { Search, Xmark } from "iconoir-react";
import {
  Button,
  FieldError,
  Input,
  Label,
  SearchField as AriaSearchField,
  Text,
} from "react-aria-components";
import { cx } from "./cx";
import {
  fieldBox,
  fieldDescription,
  fieldError,
  fieldLabel,
} from "./field-classes";

export type SearchFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** El label sigue nombrando al campo, pero no ocupa lugar (como `SelectField`). */
  hideLabel?: boolean;
  placeholder?: string;
  description?: string;
  errorMessage?: string;
  onSubmit?: (value: string) => void;
  autoFocus?: boolean;
  maxLength?: number;
  isDisabled?: boolean;
  tourAnchor?: string;
  className?: string;
};

/** Spec 0161. Lupa + boton borrar (owner, 2026-10-05); Escape vacia (React Aria). */
export function SearchField({
  label,
  hideLabel = false,
  placeholder,
  description,
  errorMessage,
  tourAnchor,
  className,
  ...props
}: SearchFieldProps) {
  return (
    <AriaSearchField
      {...props}
      validationBehavior="aria"
      isInvalid={errorMessage ? true : undefined}
      data-tour={tourAnchor}
      className={cx("group grid gap-1.5", className)}
    >
      <Label className={cx(fieldLabel, hideLabel && "sr-only")}>{label}</Label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-content-muted"
          aria-hidden="true"
        />
        <Input
          placeholder={placeholder}
          className={({ isInvalid, isFocusVisible, isDisabled }) =>
            cx(
              fieldBox({ isInvalid, isFocusVisible, isDisabled }),
              "pr-11 pl-11 placeholder:text-content-muted [&::-webkit-search-cancel-button]:appearance-none",
            )
          }
        />
        <Button
          aria-label="Borrar búsqueda"
          className="absolute top-1/2 right-1 grid size-10 -translate-y-1/2 place-items-center rounded-sm text-content-muted outline-none group-data-empty:hidden data-hovered:bg-primary-soft data-focus-visible:outline-2 data-focus-visible:outline-focus"
        >
          <Xmark className="size-5" aria-hidden="true" />
        </Button>
      </div>
      {description && (
        <Text slot="description" className={fieldDescription}>
          {description}
        </Text>
      )}
      <FieldError className={fieldError}>{errorMessage}</FieldError>
    </AriaSearchField>
  );
}
