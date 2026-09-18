"use client";

import { Minus, Plus } from "iconoir-react";
import {
  Button,
  FieldError,
  Group,
  Input,
  Label,
  NumberField as AriaNumberField,
  Text,
  type NumberFieldProps as AriaNumberFieldProps,
} from "react-aria-components";
import { cx } from "./cx";

export type NumberFieldProps = Omit<
  AriaNumberFieldProps,
  "children" | "className"
> & {
  label: string;
  description?: string;
  errorMessage?: string;
  className?: string;
};

export function NumberField({
  label,
  description,
  errorMessage,
  className,
  ...props
}: NumberFieldProps) {
  return (
    <AriaNumberField
      {...props}
      validationBehavior={props.validationBehavior ?? "aria"}
      isInvalid={props.isInvalid ?? Boolean(errorMessage)}
      className={cx("grid gap-1.5", className)}
    >
      <Label className="cp-field-label text-base font-bold leading-5 text-content">
        {label}
      </Label>
      <Group className="cp-number-stepper grid grid-cols-[3rem_1fr_3rem] overflow-hidden rounded-md border border-border-strong bg-surface focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus">
        <Button
          slot="decrement"
          className="grid min-h-12 place-items-center border-r border-border text-content outline-none hover:bg-primary-soft disabled:bg-disabled disabled:text-on-disabled"
        >
          <Minus className="size-5" aria-hidden="true" />
          <span className="sr-only">Restar uno</span>
        </Button>
        <Input className="cp-number-input min-w-0 border-0 bg-transparent px-2 text-center text-lg font-bold text-content outline-none" />
        <Button
          slot="increment"
          className="grid min-h-12 place-items-center border-l border-border text-content outline-none hover:bg-primary-soft disabled:bg-disabled disabled:text-on-disabled"
        >
          <Plus className="size-5" aria-hidden="true" />
          <span className="sr-only">Sumar uno</span>
        </Button>
      </Group>
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
    </AriaNumberField>
  );
}
