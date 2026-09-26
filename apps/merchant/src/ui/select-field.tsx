"use client";

import { NavArrowDown } from "iconoir-react";
import {
  Button,
  FieldError,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
  Text,
  type Key,
  type SelectProps as AriaSelectProps,
} from "react-aria-components";
import { cx } from "./cx";

export type SelectOption = { id: Key; label: string; description?: string };

export type SelectFieldProps = Omit<
  AriaSelectProps<SelectOption>,
  "children" | "className"
> & {
  label: string;
  options: SelectOption[];
  description?: string;
  errorMessage?: string;
  placeholder?: string;
  className?: string;
  /** El label sigue nombrando al control para lectores de pantalla, pero no ocupa lugar
   * (p. ej. un filtro de toolbar). Spec 0095. */
  hideLabel?: boolean;
};

export function SelectField({
  label,
  options,
  description,
  errorMessage,
  placeholder = "Seleccioná una opción",
  className,
  hideLabel = false,
  ...props
}: SelectFieldProps) {
  return (
    <Select
      {...props}
      validationBehavior={props.validationBehavior ?? "aria"}
      isInvalid={props.isInvalid ?? Boolean(errorMessage)}
      className={cx("grid gap-1.5", className)}
    >
      <Label
        className={cx(
          "cp-field-label text-base font-bold leading-5 text-content",
          hideLabel && "sr-only",
        )}
      >
        {label}
      </Label>
      <Button
        className={({ isDisabled, isFocusVisible }) =>
          cx(
            "flex min-h-12 w-full items-center justify-between gap-3 rounded-md border border-border-strong bg-surface px-3.5 py-2.5 text-left text-base text-content outline-none data-invalid:border-danger",
            isFocusVisible && "outline-2 outline-offset-2 outline-focus",
            isDisabled &&
              "cursor-not-allowed border-disabled bg-disabled text-on-disabled",
          )
        }
      >
        <SelectValue className="truncate data-[placeholder]:text-content-muted">
          {({ isPlaceholder, selectedText }) =>
            isPlaceholder ? placeholder : selectedText
          }
        </SelectValue>
        <NavArrowDown className="size-5 shrink-0" aria-hidden="true" />
      </Button>
      {description && (
        <Text
          slot="description"
          className="text-sm leading-5 text-content-muted"
        >
          {description}
        </Text>
      )}
      <FieldError className="text-sm font-semibold leading-5 text-danger">
        {errorMessage}
      </FieldError>
      <Popover className="w-[var(--trigger-width)] rounded-md border border-border bg-surface-raised p-1 shadow-lg outline-none">
        <ListBox
          items={options}
          className="max-h-72 overflow-auto outline-none"
        >
          {(option) => (
            <ListBoxItem
              textValue={option.label}
              className={({ isFocused, isSelected, isDisabled }) =>
                cx(
                  "grid min-h-11 cursor-default rounded-sm px-3 py-2 text-base text-content outline-none",
                  (isFocused || isSelected) && "bg-primary-soft text-content",
                  isDisabled && "text-content-disabled",
                )
              }
            >
              <span className="font-semibold">{option.label}</span>
              {option.description && (
                <span className="text-sm text-content-muted">
                  {option.description}
                </span>
              )}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </Select>
  );
}
