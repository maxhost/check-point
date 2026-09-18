"use client";

import {
  FieldError,
  Input,
  Label,
  Text,
  TextField as AriaTextField,
  type TextFieldProps as AriaTextFieldProps,
} from "react-aria-components";
import { cx } from "./cx";

export type TextFieldProps = Omit<
  AriaTextFieldProps,
  "children" | "className"
> & {
  label: string;
  description?: string;
  errorMessage?: string;
  placeholder?: string;
  className?: string;
};

export function TextField({
  label,
  description,
  errorMessage,
  placeholder,
  className,
  ...props
}: TextFieldProps) {
  return (
    <AriaTextField
      {...props}
      validationBehavior={props.validationBehavior ?? "aria"}
      isInvalid={props.isInvalid ?? Boolean(errorMessage)}
      className={cx("grid gap-1.5", className)}
    >
      <Label className="cp-field-label text-base font-bold leading-5 text-content">
        {label}
      </Label>
      <Input
        placeholder={placeholder}
        className={({ isDisabled, isInvalid, isFocusVisible }) =>
          cx(
            "min-h-12 w-full rounded-md border bg-surface px-3.5 py-2.5 text-base text-content outline-none",
            "placeholder:text-content-muted",
            isInvalid ? "border-danger" : "border-border-strong",
            isFocusVisible && "outline-2 outline-offset-2 outline-focus",
            isDisabled &&
              "cursor-not-allowed border-disabled bg-disabled text-on-disabled",
          )
        }
      />
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
    </AriaTextField>
  );
}
