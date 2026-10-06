"use client";

import { parseTime } from "@internationalized/date";
import {
  DateInput,
  DateSegment,
  FieldError,
  I18nProvider,
  Label,
  Text,
  TimeField as AriaTimeField,
} from "react-aria-components";
import { cx } from "./cx";
import {
  fieldBox,
  fieldDescription,
  fieldError,
  fieldLabel,
  segmentClasses,
} from "./field-classes";

export type TimeFieldProps = {
  label: string;
  /** `"HH:mm"`, como un `input type="time"`; `""` = vacio. */
  value: string;
  onChange: (value: string) => void;
  hideLabel?: boolean;
  description?: string;
  errorMessage?: string;
  isDisabled?: boolean;
  isRequired?: boolean;
  name?: string;
  tourAnchor?: string;
  className?: string;
};

function toTime(value: string) {
  try {
    return value ? parseTime(value) : null;
  } catch {
    return null;
  }
}

/** Spec 0161. Segmentos de React Aria, `es-419` y 24 h fijos; el valor sigue siendo texto. */
export function TimeField({
  label,
  value,
  onChange,
  hideLabel = false,
  description,
  errorMessage,
  tourAnchor,
  className,
  ...props
}: TimeFieldProps) {
  return (
    <I18nProvider locale="es-419">
      <AriaTimeField
        {...props}
        value={toTime(value)}
        onChange={(time) => onChange(time ? time.toString().slice(0, 5) : "")}
        hourCycle={24}
        granularity="minute"
        validationBehavior="aria"
        isInvalid={errorMessage ? true : undefined}
        data-tour={tourAnchor}
        className={cx("grid gap-1.5", className)}
      >
        <Label className={cx(fieldLabel, hideLabel && "sr-only")}>
          {label}
        </Label>
        <DateInput
          className={({ isInvalid, isFocusVisible, isDisabled }) =>
            cx(
              fieldBox({ isInvalid, isFocusVisible, isDisabled }),
              "flex items-center",
            )
          }
        >
          {(segment) => (
            <DateSegment segment={segment} className={segmentClasses} />
          )}
        </DateInput>
        {description && (
          <Text slot="description" className={fieldDescription}>
            {description}
          </Text>
        )}
        <FieldError className={fieldError}>{errorMessage}</FieldError>
      </AriaTimeField>
    </I18nProvider>
  );
}
