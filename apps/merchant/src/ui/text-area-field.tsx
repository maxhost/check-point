"use client";
import { useLayoutEffect, useRef } from "react";
import {
  TextField as AriaTextField,
  Label,
  TextArea,
  Text,
  FieldError,
} from "react-aria-components";
import type { TextFieldProps } from "./text-field";
import { cx } from "./cx";
export type TextAreaFieldProps = TextFieldProps & { autoGrow?: boolean };
export function TextAreaField({
  label,
  description,
  errorMessage,
  placeholder,
  className,
  autoGrow = false,
  ...props
}: TextAreaFieldProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    if (autoGrow && ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = `${Math.max(160, ref.current.scrollHeight)}px`;
    }
  }, [autoGrow, props.value]);
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
      <TextArea
        ref={ref}
        placeholder={placeholder}
        className="cp-textarea min-h-40 w-full rounded-md border border-border-strong bg-surface px-3.5 py-2.5 text-base text-content outline-none placeholder:text-content-muted data-[invalid]:border-danger data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-focus disabled:bg-disabled disabled:text-on-disabled"
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
