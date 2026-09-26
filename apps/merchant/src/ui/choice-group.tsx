"use client";
import {
  RadioGroup,
  Radio,
  Label,
  Text,
  FieldError,
  type RadioGroupProps,
} from "react-aria-components";
import { cx } from "./cx";
export type ChoiceGroupProps = Omit<
  RadioGroupProps,
  "children" | "className"
> & {
  label: string;
  description?: string;
  errorMessage?: string;
  options: { value: string; label: string; description?: string }[];
  variant?: "cards" | "compact";
  className?: string;
};
export function ChoiceGroup({
  label,
  description,
  errorMessage,
  options,
  variant = "compact",
  className,
  ...props
}: ChoiceGroupProps) {
  return (
    <RadioGroup
      {...props}
      validationBehavior="aria"
      isInvalid={props.isInvalid ?? Boolean(errorMessage)}
      className={cx("grid gap-1.5", className)}
    >
      <Label className="cp-field-label text-base font-bold leading-5 text-content">
        {label}
      </Label>
      <div
        className={cx(
          "cp-choices flex flex-wrap gap-2",
          variant === "cards" && "cp-choice-cards",
        )}
      >
        {options.map((option) => (
          <Radio
            key={option.value}
            value={option.value}
            className="cp-choice flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-border-strong bg-surface px-3 py-2 text-base text-content data-[selected]:border-primary data-[selected]:bg-primary-soft data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-focus data-[disabled]:bg-disabled data-[disabled]:text-on-disabled"
          >
            <span aria-hidden="true" className="cp-radio-mark" />
            <span>
              <strong>{option.label}</strong>
              {option.description && (
                <span className="block text-sm text-content-muted">
                  {option.description}
                </span>
              )}
            </span>
          </Radio>
        ))}
      </div>
      {description && (
        <Text
          slot="description"
          className="text-sm leading-5 text-content-muted"
        >
          {description}
        </Text>
      )}
      <FieldError className="text-sm font-semibold text-danger">
        {errorMessage}
      </FieldError>
    </RadioGroup>
  );
}
